import { Order, OrderItem, PaymentMethod, OrderType } from '../../types';

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
  paymentMethod?: PaymentMethod;
  type?: OrderType;
}

export type { Order, OrderItem };
