import { Order, CreateOrderPayload } from '../entities/order';

export interface IOrdersRepository {
  fetchOrders(branchId?: string): Promise<Order[]>;
  createOrder(payload: CreateOrderPayload, branchId?: string): Promise<Order>;
  updateOrderStatus(orderId: string, status: Order['status']): Promise<void>;
}
