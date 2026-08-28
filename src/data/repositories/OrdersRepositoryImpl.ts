import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, updateOrderStatusFirestore, getAuthToken } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { IOrdersRepository } from '../../domain/repositories/IOrdersRepository';
import { CreateOrderPayload } from '../../domain/entities/order';
import { Order } from '../../types';

export class OrdersRepositoryImpl implements IOrdersRepository {
  async fetchOrders(branchId?: string): Promise<Order[]> {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.ORDERS), where('branchId', '==', branchId))
      : collection(db, COLLECTIONS.ORDERS);
    const snap = await getDocs(q);
    const list: Order[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createOrder(payload: CreateOrderPayload, branchId?: string): Promise<Order> {
    const token = await getAuthToken();
    const res = await fetch(getApiUrl('/api/pos/complete'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...payload,
        branchId: branchId || (payload as any).branchId
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Order creation failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.order || data;
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    await updateOrderStatusFirestore(orderId, status as any);
  }
}
