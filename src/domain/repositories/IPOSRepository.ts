import { POSCheckoutPayload, ReceiptData } from '../entities/pos';
import { Order } from '../../types';

export interface IPOSRepository {
  createOrder(payload: POSCheckoutPayload): Promise<ReceiptData>;
  fetchRecentOrders(): Promise<Order[]>;
}
