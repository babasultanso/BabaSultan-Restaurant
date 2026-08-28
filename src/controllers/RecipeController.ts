import { IRecipeRepository } from '../domain/repositories/IRecipeRepository';
import {
  Recipe,
  Ingredient,
  UnitConversion,
  StockCount,
  WasteRecord,
  ConsumptionStat,
  IngredientForecast,
  FoodCostDashboardData,
  RecipeItem
} from '../domain/entities/recipe';
import { UnitConversionEngine } from '../lib/unitConversionEngine';

export class RecipeController {
  constructor(private recipeRepo: IRecipeRepository) {}

  // Recipe Subscriptions & CRUD
  subscribeRecipes(callback: (recipes: Recipe[]) => void, branchId?: string): () => void {
    return this.recipeRepo.subscribeRecipes(callback, branchId);
  }

  async fetchRecipes(branchId?: string): Promise<Recipe[]> {
    return this.recipeRepo.fetchRecipes(branchId);
  }

  async getRecipeByProductId(productId: string): Promise<Recipe | null> {
    return this.recipeRepo.getRecipeByProductId(productId);
  }

  async createRecipe(data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> {
    return this.recipeRepo.createRecipe(data);
  }

  async updateRecipe(
    id: string,
    data: Partial<Recipe>,
    changeReason?: string,
    changedBy?: string
  ): Promise<void> {
    return this.recipeRepo.updateRecipe(id, data, changeReason, changedBy);
  }

  async deleteRecipe(id: string): Promise<void> {
    return this.recipeRepo.deleteRecipe(id);
  }

  async fetchRecipeHistory(recipeId: string) {
    return this.recipeRepo.fetchRecipeHistory(recipeId);
  }

  // Ingredient Subscriptions & CRUD
  subscribeIngredients(callback: (ingredients: Ingredient[]) => void, branchId?: string): () => void {
    return this.recipeRepo.subscribeIngredients(callback, branchId);
  }

  async fetchIngredients(branchId?: string): Promise<Ingredient[]> {
    return this.recipeRepo.fetchIngredients(branchId);
  }

  async createIngredient(data: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ingredient> {
    return this.recipeRepo.createIngredient(data);
  }

  async updateIngredient(id: string, data: Partial<Ingredient>): Promise<void> {
    return this.recipeRepo.updateIngredient(id, data);
  }

  async deleteIngredient(id: string): Promise<void> {
    return this.recipeRepo.deleteIngredient(id);
  }

  // Movements
  subscribeIngredientMovements(callback: (movements: any[]) => void): () => void {
    return this.recipeRepo.subscribeIngredientMovements(callback);
  }

  // Unit Conversions
  subscribeUnitConversions(callback: (conversions: UnitConversion[]) => void): () => void {
    return this.recipeRepo.subscribeUnitConversions(callback);
  }

  async createUnitConversion(data: Omit<UnitConversion, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.recipeRepo.createUnitConversion(data);
  }

  async deleteUnitConversion(id: string) {
    return this.recipeRepo.deleteUnitConversion(id);
  }

  // Stock Counts
  async fetchStockCounts(): Promise<StockCount[]> {
    return this.recipeRepo.fetchStockCounts();
  }

  async createStockCount(data: Omit<StockCount, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.recipeRepo.createStockCount(data);
  }

  async applyStockCountAdjustment(id: string, user: string) {
    return this.recipeRepo.applyStockCountAdjustment(id, user);
  }

  // Waste Management
  subscribeWasteRecords(callback: (records: WasteRecord[]) => void, branchId?: string): () => void {
    return this.recipeRepo.subscribeWasteRecords(callback, branchId);
  }

  async fetchWasteRecords(branchId?: string): Promise<WasteRecord[]> {
    return this.recipeRepo.fetchWasteRecords(branchId);
  }

  async recordWaste(data: Omit<WasteRecord, 'id' | 'createdAt'>) {
    return this.recipeRepo.recordWaste(data);
  }

  // Analytics
  async getConsumptionAnalytics(): Promise<ConsumptionStat[]> {
    return this.recipeRepo.getConsumptionAnalytics();
  }

  async getIngredientForecasts(): Promise<IngredientForecast[]> {
    return this.recipeRepo.getIngredientForecasts();
  }

  async getFoodCostDashboardData(): Promise<FoodCostDashboardData> {
    return this.recipeRepo.getFoodCostDashboardData();
  }

  // Calculation Utilities for UI
  calculateRecipeTotals(
    items: RecipeItem[],
    sellingPrice: number,
    yieldQuantity: number = 1
  ) {
    const totalCost = items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const costPerPortion = yieldQuantity > 0 ? totalCost / yieldQuantity : totalCost;
    const foodCostPercentage = sellingPrice > 0 ? (costPerPortion / sellingPrice) * 100 : 0;
    const grossProfit = sellingPrice - costPerPortion;
    const grossProfitMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
    const netProfit = grossProfit * 0.85; // Estimated after overhead

    return {
      totalCost: Number(totalCost.toFixed(2)),
      costPerPortion: Number(costPerPortion.toFixed(2)),
      foodCostPercentage: Number(foodCostPercentage.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      grossProfitMargin: Number(grossProfitMargin.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2))
    };
  }
}
