import { Order, OrderItem } from '../../types';

export interface CreateOrderPayload {
  customerName?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    cost: number;
  }>;
  employeeId?: string;
  employeeName?: string;
  paymentMethod?: 'cash' | 'card' | 'mobile_money';
  type?: 'dine_in' | 'takeaway' | 'delivery';
}

export type { Order, OrderItem };
