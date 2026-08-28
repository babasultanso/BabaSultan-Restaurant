import { Product, SelectedOptionChoice } from '../../types';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'online' | 'reservation';
export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'online' | 'split';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: SelectedOptionChoice[];
  selectedNotes?: string;
  unitPrice: number;
  totalPrice: number;
}

export interface POSCheckoutPayload {
  customerName: string;
  customerPhone?: string;
  orderType: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  deliveryFee?: number;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  changeDue?: number;
  employeeId: string;
  employeeName: string;
  notes?: string;
}

export interface ReceiptData {
  orderId: string;
  orderNumber: string;
  timestamp: string;
  cashierName: string;
  orderType: OrderType;
  tableNumber?: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  taxRate?: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  changeDue?: number;
}
