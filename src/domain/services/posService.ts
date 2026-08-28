import { CartItem } from '../entities/pos';
import { SelectedOptionChoice } from '../../types';

export interface CartCalculationResult {
  subtotal: number;
  optionsTotal: number;
  tax: number;
  discountAmount: number;
  grandTotal: number;
}

export function calculateCartTotals(
  cart: CartItem[],
  taxRatePercent: number = 5,
  discountValue: number = 0,
  discountType: 'percentage' | 'fixed' = 'percentage'
): CartCalculationResult {
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const optionsTotal = cart.reduce((sum, item) => {
    if (!item.selectedOptions || item.selectedOptions.length === 0) return sum;
    const itemOptCost = item.selectedOptions.reduce((oSum, opt) => oSum + (opt.priceModifier || 0), 0);
    return sum + (itemOptCost * item.quantity);
  }, 0);

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discountValue) / 100;
  } else {
    discountAmount = Math.min(subtotal, discountValue);
  }

  const discountAmountRounded = Math.round(discountAmount * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmountRounded);
  const tax = Math.round(((taxableAmount * taxRatePercent) / 100) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + tax) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    optionsTotal: Math.round(optionsTotal * 100) / 100,
    tax,
    discountAmount: discountAmountRounded,
    grandTotal
  };
}

export function calculateTenderChange(amountTendered: number, grandTotal: number) {
  return {
    amountTendered: grandTotal,
    changeDue: 0
  };
}

export function formatOptionSummary(options?: SelectedOptionChoice[]): string {
  if (!options || options.length === 0) return '';
  return options.map(o => `${o.choiceName}${o.priceModifier > 0 ? ` (+$${o.priceModifier.toFixed(2)})` : ''}`).join(', ');
}
