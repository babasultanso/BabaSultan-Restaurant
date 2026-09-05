import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, createOrderFirestore } from '../../lib/firebase';
import { IPOSRepository } from '../../domain/repositories/IPOSRepository';
import { POSCheckoutPayload, ReceiptData } from '../../domain/entities/pos';
import { Order } from '../../types';

export class POSRepositoryImpl implements IPOSRepository {
  async createOrder(payload: POSCheckoutPayload): Promise<ReceiptData> {
    const timestamp = new Date().toISOString();
    const dateCode = new Date().toISOString().replace(/[-:T.]/g, '').slice(2, 10);
    const randomSeq = Math.floor(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
    const orderNumber = `ORD-${dateCode}-${randomSeq}`;

    const fullOrder = await createOrderFirestore({
      orderNumber,
      customerName: payload.customerName || 'Walk-in Customer',
      customerPhone: payload.customerPhone || '',
      orderType: payload.orderType,
      deliveryAddress: payload.deliveryAddress,
      deliveryZoneId: payload.deliveryZoneId,
      deliveryZoneName: payload.deliveryZoneName,
      deliveryFee: payload.deliveryFee,
      tableNumber: payload.tableNumber || '',
      items: payload.items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: typeof i.product.cost === 'number' ? i.product.cost : 0,
        totalPrice: i.totalPrice,
        notes: i.selectedNotes || ''
      })),
      subtotal: payload.subtotal,
      tax: payload.tax,
      discountAmount: payload.discount,
      totalAmount: payload.totalAmount,
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      status: 'new',
      prepStatus: 'new',
      deliveryStatus: payload.orderType === 'delivery' ? 'unassigned' : undefined,
      paymentMethod: payload.paymentMethod,
      paymentStatus: 'paid',
      amountTendered: payload.amountTendered || payload.totalAmount,
      changeDue: payload.changeDue || 0,
      createdAt: timestamp,
      cogs: 0,
      profit: 0
    });

    return {
      orderId: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      timestamp,
      cashierName: payload.employeeName,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      customerName: payload.customerName || 'Walk-in Customer',
      items: payload.items,
      subtotal: fullOrder.subtotal,
      tax: fullOrder.tax,
      discount: fullOrder.discountAmount,
      totalAmount: fullOrder.totalAmount,
      paymentMethod: payload.paymentMethod,
      amountTendered: payload.amountTendered,
      changeDue: payload.changeDue
    };
  }

  async fetchRecentOrders(branchId?: string): Promise<Order[]> {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.ORDERS), where('branchId', '==', branchId))
      : collection(db, COLLECTIONS.ORDERS);
    const snap = await getDocs(q);
    const orders: Order[] = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() } as Order));
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
