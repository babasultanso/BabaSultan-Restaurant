export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateCustomerInput(data: {
  fullName: string;
  phone: string;
  email?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.fullName = 'Full Name is required (minimum 2 characters)';
  }

  if (!data.phone || data.phone.trim().length < 6) {
    errors.phone = 'Valid Phone Number is required';
  }

  if (data.email && data.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.email = 'Invalid Email format';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateWalletRecharge(amount: number, method: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!amount || amount <= 0) {
    errors.amount = 'Recharge amount must be greater than 0';
  }

  if (!method) {
    errors.method = 'Payment method is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateCouponInput(data: {
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minOrderAmount: number;
  expiryDate: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.code || data.code.trim().length < 3) {
    errors.code = 'Coupon code must be at least 3 characters';
  }

  if (!data.discountValue || data.discountValue <= 0) {
    errors.discountValue = 'Discount value must be greater than 0';
  }

  if (data.discountType === 'percentage' && data.discountValue > 100) {
    errors.discountValue = 'Percentage discount cannot exceed 100%';
  }

  if (data.minOrderAmount < 0) {
    errors.minOrderAmount = 'Minimum order amount cannot be negative';
  }

  if (!data.expiryDate) {
    errors.expiryDate = 'Expiration date is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
